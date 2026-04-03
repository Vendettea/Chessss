using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Chessss.Migrations
{
    /// <inheritdoc />
    public partial class AddImageUrlToTrainingMaterial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ImageUrl",
                table: "TrainingMaterials",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ImageUrl",
                table: "TrainingMaterials");
        }
    }
}
